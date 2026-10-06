using ArcaneLibs.Collections;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Spacebar.Sdk.Core;

public class SpacebarClientProviderService(ILogger<SpacebarClientProviderService> logger, IServiceProvider serviceProvider, SpacebarClientWellKnownResolverService clientWellKnownResolver) {
    private static readonly SemaphoreCache<UnauthenticatedSpacebarClient> UnauthenticatedClientCache = new();
    private static readonly SemaphoreCache<AuthenticatedSpacebarClient> AuthenticatedClientCache = new();

    public async Task<UnauthenticatedSpacebarClient> GetUnauthenticatedClientAsync(string serverName) {
        return await UnauthenticatedClientCache.GetOrAdd(serverName, async () => {
            logger.LogInformation("Creating a new unauthenticated client for {serverName}!", serverName);
            var clientLogger = serviceProvider.GetRequiredService<ILogger<UnauthenticatedSpacebarClient>>();
            var wellKnown = await clientWellKnownResolver.ResolveClientWellKnown(serverName);
            return new UnauthenticatedSpacebarClient(clientLogger, wellKnown);
        });
    }
    
    public async Task<AuthenticatedSpacebarClient> GetAuthenticatedClientAsync(string serverName, string accessToken) {
        // the cache must be keyed on the token too: callers authenticate as different users
        // on the same instance, and returning the first user's client makes them act as that user.
        return await AuthenticatedClientCache.GetOrAdd($"{serverName}|{accessToken}", async () => {
            logger.LogInformation("Creating a new authenticated client for {serverName}!", serverName);
            var clientLogger = serviceProvider.GetRequiredService<ILogger<AuthenticatedSpacebarClient>>();
            var wellKnown = await clientWellKnownResolver.ResolveClientWellKnown(serverName);
            return new AuthenticatedSpacebarClient(clientLogger, serviceProvider, wellKnown, accessToken);
        });
    }
}