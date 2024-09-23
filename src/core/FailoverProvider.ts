import type {
  JsonRpcApiProviderOptions,
  JsonRpcPayload,
  JsonRpcResult,
  Network,
} from 'ethers';
import { JsonRpcProvider, FetchRequest } from 'ethers';

/**
 * A `JsonRpcProvider` that transparently fails over to a list of backup JSON-RPC endpoints.
 *
 * Use the static `create` method to instantiate this provider.
 */
export class FailoverJsonRpcProvider extends JsonRpcProvider {
  private readonly _rpcEndpoints: (string | FetchRequest)[];

  private constructor(
    rpcEndpoints: (string | FetchRequest)[],
    expectedNetwork: Network,
    options?: JsonRpcApiProviderOptions,
  ) {
    super(rpcEndpoints[0], expectedNetwork, options);

    this._rpcEndpoints = rpcEndpoints;
  }

  /**
   * Creates a new `FailoverJsonRpcProvider`.
   *
   * @param rpcEndpoints - An array of JSON-RPC endpoints to use for failover. Order matters.
   * @param options - Additional options for the JsonRpcProvider (optional).
   * @returns A promise that resolves to an instance of `FailoverJsonRpcProvider`.
   *
   * @throws If endpoints are unreachable or are on different networks.
   */
  public static async create(
    rpcEndpoints: (string | FetchRequest)[],
    options?: JsonRpcApiProviderOptions,
  ): Promise<FailoverJsonRpcProvider> {
    if (!Array.isArray(rpcEndpoints) || rpcEndpoints.length === 0) {
      throw new Error('Endpoints array must be a non-empty array of URLs.');
    }

    // Use the primary endpoint to verify that all other endpoints are on the same network.
    let expectedNetwork: Network;
    try {
      const primaryProvider = new JsonRpcProvider(
        rpcEndpoints[0],
        undefined,
        options,
      );
      expectedNetwork = await primaryProvider.getNetwork();
    } catch (error: any) {
      const endpointUrl = getEndpointUrl(rpcEndpoints[0]);
      throw new Error(
        `Failed to get network from primary endpoint '${endpointUrl}': ${error.message}`,
      );
    }

    for (const endpoint of rpcEndpoints.slice(1)) {
      try {
        const provider = new JsonRpcProvider(endpoint, undefined, options);
        const { chainId } = await provider.getNetwork();

        if (chainId !== expectedNetwork.chainId) {
          const endpointUrl = getEndpointUrl(endpoint);
          throw new Error(
            `Endpoint '${endpointUrl}' is on a different network (chainId: ${chainId}). Primary endpoint is on chainId: ${expectedNetwork.chainId}.`,
          );
        }
      } catch (error: any) {
        const endpointUrl = getEndpointUrl(endpoint);
        throw new Error(
          `Failed to verify network for endpoint '${endpointUrl}': ${error.message}`,
        );
      }
    }

    return new FailoverJsonRpcProvider(rpcEndpoints, expectedNetwork, options);
  }

  /**
   * Overrides the `_send` method to try each endpoint until the request succeeds.
   *
   * @param payload - The JSON-RPC payload or array of payloads to send.
   * @returns A promise that resolves to the result of the JSON-RPC call(s).
   */
  public override async _send(
    payload: JsonRpcPayload | Array<JsonRpcPayload>,
  ): Promise<Array<JsonRpcResult>> {
    // The actual sending of the request is the same as in the base class.
    // The only difference is that we're creating a new `FetchRequest` for each endpoint,
    // instead of getting the `request` from `_getConnection()`, which will return the *primary* endpoint.

    const errors: { endpoint: string; error: any }[] = [];

    // Try each endpoint, in order.
    for (const endpoint of this._rpcEndpoints) {
      try {
        // Create a FetchRequest instance from the endpoint
        let request: FetchRequest;

        if (typeof endpoint === 'string') {
          request = new FetchRequest(endpoint);
        } else {
          request = endpoint.clone();
        }

        request.body = JSON.stringify(payload);
        request.setHeader('content-type', 'application/json');
        const response = await request.send();
        response.assertOk();

        let resp = response.bodyJson;
        if (!Array.isArray(resp)) {
          resp = [resp];
        }

        return resp;
      } catch (error: any) {
        const endpointUrl = getEndpointUrl(endpoint);
        errors.push({ endpoint: endpointUrl, error });
      }
    }

    // All endpoints failed. Throw an error containing the details.
    const errorMessages = errors
      .map(
        (e) =>
          `Endpoint '${e.endpoint}' failed with error: ${e.error.message}.`,
      )
      .join('\n');

    const aggregatedError = new Error(
      `All RPC endpoints failed:\n${errorMessages}`,
    ) as Error & { errors: { endpoint: string; error: any }[] };
    aggregatedError.errors = errors;

    throw aggregatedError;
  }

  /**
   * Returns a copy of the endpoint URLs used by the provider.
   *
   * @returns An array of endpoint URLs as strings.
   */
  public getEndpoints(): string[] {
    return this._rpcEndpoints.map(getEndpointUrl);
  }
}

function getEndpointUrl(endpoint: string | FetchRequest): string {
  if (typeof endpoint === 'string') {
    return endpoint;
  }
  return endpoint.url;
}
