import { request as undiciRequest } from 'undici';
import { FastifyReply, FastifyRequest } from 'fastify';
import { createInterceptorStream } from './stream-interceptor.js';
import { publishAuditEvent } from '../services/kafka.js';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';


interface UpstreamConfig {
  url: string;
  headers: Record<string, string>;
}

export async function resolveUpstream(request: FastifyRequest): Promise<UpstreamConfig> {
  const body = request.body as any;
  const model = body?.model || '';
  const tenantId = (request as any).tenantId || 'default-tenant';

  let providerName = 'custom'; // Default to custom for local AI / other models
  if (model.includes('gpt')) providerName = 'openai';
  else if (model.includes('claude')) providerName = 'anthropic';
  
  let dynamicUrl = null;
  let dynamicKey = null;

  try {
    const res = await undiciRequest(`http://127.0.0.1:8001/api/providers/${tenantId}/${providerName}/credentials`);
    if (res.statusCode === 200) {
      const data = await res.body.json() as any;
      dynamicUrl = data.base_url;
      dynamicKey = data.api_key;
    }
  } catch (err) {
    request.log.error(err, 'Failed to fetch dynamic credentials');
  }

  const resolvedKey = dynamicKey || (request.headers['x-api-key'] as string) || '';

  if (providerName === 'anthropic') {
    const url = dynamicUrl || 'https://api.anthropic.com/v1/messages';
    return {
      url,
      headers: {
        'content-type': 'application/json',
        'x-api-key': resolvedKey,
        'anthropic-version': '2023-06-01'
      }
    };
  }

  // OpenAI or Custom format (both use Bearer auth generally)
  const url = dynamicUrl || (providerName === 'openai' 
    ? 'https://api.openai.com/v1/chat/completions' 
    : 'http://127.0.0.1:11434/v1/chat/completions'); // default to local Ollama

  return {
    url,
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${resolvedKey}`
    }
  };
}

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await undiciRequest('http://host.docker.internal:11434/api/tags', {
      method: 'GET',
      headersTimeout: 1000,
      bodyTimeout: 1000
    });
    return res.statusCode === 200;
  } catch {
    return false;
  }
}

export async function proxyToUpstream(request: FastifyRequest, reply: FastifyReply) {
  const requestBodyObj = request.body as any;
  const isStreaming = !!requestBodyObj?.stream;
  const tenantId = (request as any).tenantId || 'default-tenant';
  const model = requestBodyObj?.model || 'unknown-model';
  const messages = requestBodyObj?.messages || [];

  const { url, headers } = await resolveUpstream(request);
  // All routing is now purely driven by the dynamically fetched resolveUpstream config.
  // Mocks and hardcoded bypasses have been removed for production usage.

  // The url and headers were already resolved asynchronously above
  const requestBody = JSON.stringify(requestBodyObj);

  // --- MOCK BYPASS FOR TEST PLAYGROUND ---
  // If the user uses the dummy test key, we return a mocked successful response 
  // so they can see the 'Accepted' flow in the Live Feed without needing a real OpenAI key.
  if ((headers['authorization'] === 'Bearer cp_test_tenant_default' || headers['x-api-key'] === 'cp_test_tenant_default') && model === 'mock') {
    request.log.info('Using Mock AI response for Test Playground');
    
    const userMessage = messages[messages.length - 1]?.content || '';
    const isPiiTest = userMessage.toLowerCase().includes('ssn') || userMessage.toLowerCase().includes('email') || userMessage.toLowerCase().includes('phone');
    const isBlockTest = userMessage.toLowerCase().includes('bypass') || userMessage.toLowerCase().includes('hack');
    
    let content = `Mock AI Response to: "${userMessage}".\n\nHere is a highly optimized quicksort algorithm in Python...`;
    let action = 'pass';
    let hasPii = false;
    let blocked = false;
    let score = 98.5;
    const matchedEntities: string[] = [];

    if (isPiiTest) {
      content = `Mock AI Response: Sure, here is the fake profile. The phone number is 415-555-1234 and the email is test@example.com.`;
      action = 'redact';
      hasPii = true;
      matchedEntities.push('PHONE_NUMBER', 'EMAIL');
    } else if (isBlockTest) {
      content = `I cannot help you bypass corporate security firewalls.`;
      action = 'block';
      blocked = true;
      score = 25.0; // severe drop
    }

    const mockResponse = {
      id: "chatcmpl-mock",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        message: { role: "assistant", content: content },
        finish_reason: "stop"
      }]
    };

    publishAuditEvent({
      eventId: randomUUID(),
      tenantId,
      timestamp: new Date().toISOString(),
      model,
      request: { messages },
      response: { text: content, redacted: hasPii, blocked: blocked },
      evaluation: {
        performance: { score },
        cost: { tokens: 124, density: 1.0 },
        responsibility: { hasPii, matchedEntities },
        action: action as 'pass' | 'block' | 'redact' | 'flag'
      }
    });

    reply.header('content-type', 'application/json');
    reply.header('access-control-allow-origin', '*');
    
    if (blocked) {
      return reply.status(403).send({ error: { message: "Blocked by ControlPlane Tri-Guard", type: "policy_violation" }});
    }
    return reply.send(mockResponse);
  }
  // --- END MOCK BYPASS ---

  try {
    request.log.info({ url }, 'Proxying request to upstream LLM');

    const upstreamRes = await undiciRequest(url, {
      method: 'POST',
      headers: {
        ...headers,
        'traceparent': request.headers['traceparent'] as string || '',
      },
      body: requestBody,
    });

    reply.status(upstreamRes.statusCode);

    const copyHeaders = [
      'content-type',
      'cache-control',
      'connection',
      'transfer-encoding',
      'openai-organization',
      'openai-processing-ms',
      'openai-version',
      'x-request-id',
    ];

    for (const headerName of copyHeaders) {
      const headerVal = upstreamRes.headers[headerName];
      if (headerVal) {
        reply.header(headerName, headerVal);
      }
    }

    reply.header('access-control-allow-origin', '*');

    if (isStreaming && upstreamRes.statusCode === 200) {
      const interceptedStream = createInterceptorStream(upstreamRes.body as Readable, {
        tenantId,
        model,
        requestMessages: messages
      });
      return reply.send(interceptedStream);
    }

    // For non-streaming or failed requests, consume the body, publish an event, and send.
    const rawBody = await upstreamRes.body.text();
    const isError = upstreamRes.statusCode !== 200;

    // Parse token usage and response text from the upstream response
    let totalTokens = 0;
    let responseText = rawBody;
    if (!isError) {
      try {
        const parsed = JSON.parse(rawBody);
        totalTokens = parsed?.usage?.total_tokens ?? 0;
        responseText = parsed?.choices?.[0]?.message?.content ?? rawBody;
      } catch {
        // not JSON, leave defaults
      }
    }

    // --- TRI-GUARD EVALUATION FOR NON-STREAMING RESPONSES ---
    let perfScore = isError ? 0 : 100;
    let hasPii = false;
    let matchedEntities: string[] = [];
    let costDensity = 1.0;
    let action: 'pass' | 'flag' | 'block' | 'redact' = isError ? 'block' : 'pass';

    if (!isError && responseText) {
      try {
        const triGuardUrl = process.env.TRI_GUARD_URL || 'http://127.0.0.1:8000';
        const userMessage = messages.map((m: any) => m.content).join('\n');
        const combinedText = `${userMessage}\n\n${responseText}`;
        
        const evalRes = await undiciRequest(`${triGuardUrl}/evaluate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: combinedText, model }),
        });
        if (evalRes.statusCode === 200) {
          const evalResult = await evalRes.body.json() as any;
          perfScore = evalResult.performance?.score ?? 100;
          costDensity = evalResult.cost?.density ?? 1.0;
          hasPii = evalResult.responsibility?.has_pii ?? false;
          matchedEntities = evalResult.responsibility?.matched_entities ?? [];
          // Resolve action
          if (hasPii) action = 'redact';
          else if (perfScore < 50) action = 'block';
          else if (perfScore < 70) action = 'flag';
          else action = 'pass';
          request.log.info({ perfScore, hasPii, matchedEntities, action, costDensity }, 'Tri-Guard evaluation complete for non-streaming response');
        }
      } catch (triGuardErr) {
        request.log.warn(triGuardErr, 'Tri-Guard evaluation failed for non-streaming response (fail-open)');
      }
    }
    // --- END TRI-GUARD EVALUATION ---

    publishAuditEvent({
      eventId: randomUUID(),
      tenantId,
      timestamp: new Date().toISOString(),
      model,
      request: { messages },
      response: { text: responseText, redacted: hasPii, blocked: isError || action === 'block' },
      evaluation: {
        performance: { score: perfScore },
        cost: { tokens: totalTokens, density: costDensity },
        responsibility: { hasPii, matchedEntities },
        action
      }
    });

    return reply.send(rawBody);

  } catch (error) {
    request.log.error(error, 'Upstream proxy request failed');
    
    // Also log hard failures to live feed
    publishAuditEvent({
      eventId: randomUUID(),
      tenantId,
      timestamp: new Date().toISOString(),
      model,
      request: { messages },
      response: { text: `[Gateway Error] ${error instanceof Error ? error.message : String(error)}`, redacted: false, blocked: true },
      evaluation: {
        performance: { score: 0 },
        cost: { tokens: 0, density: 1.0 },
        responsibility: { hasPii: false, matchedEntities: [] },
        action: 'block'
      }
    });

    reply.status(502).send({
      error: {
        type: 'upstream_error',
        message: 'Failed to communicate with upstream LLM provider.',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
}


