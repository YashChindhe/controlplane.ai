import OpenAI, { ClientOptions } from 'openai';

export class ControlPlane extends OpenAI {
  /**
   * ControlPlane Client - acts as a drop-in replacement wrapper for OpenAI
   * intercepting calls and routing them through ControlPlane Tri-Guard Gateway.
   */
  constructor(options: ClientOptions = {}) {
    const cpApiKey = options.apiKey || process.env.CONTROLPLANE_API_KEY;
    const cpBaseURL = options.baseURL || process.env.CONTROLPLANE_GATEWAY_URL || 'http://localhost:3000/v1';

    if (!cpApiKey) {
      throw new Error(
        'Missing ControlPlane API key. Please specify apiKey or set the CONTROLPLANE_API_KEY environment variable.'
      );
    }

    const defaultHeaders = {
      ...(options.defaultHeaders || {}),
      'x-api-key': cpApiKey,
    };

    super({
      ...options,
      apiKey: cpApiKey,
      baseURL: cpBaseURL,
      defaultHeaders,
    });
  }
}
export default ControlPlane;
