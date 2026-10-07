using Spacebar.Models.Api;
using Spacebar.Sdk.Core;

namespace Spacebar.Tests.Abstractions;

public class UserAbstraction(Config _config, SpacebarClientProviderService _clientProvider) {
    public async Task<AuthenticatedSpacebarClient> GetFreshUser(bool withAutojoinGuilds = false) {
        var ua = await _clientProvider.GetUnauthenticatedClientAsync(_config.TestInstance);
        // Under QEMU load the API can transiently return a non-JSON error page on
        // registration; retry rather than fail the whole test on it.
        var tokenResponse = await RegisterWithRetry(ua, 3);
        static async Task<RegisterResponse> RegisterWithRetry(UnauthenticatedSpacebarClient ua, int attempts) {
            for (var i = 1; ; i++) {
                try {
                    return await ua.RegisterAsync(new() {
                        Email = $"{Guid.NewGuid().ToString()}@{Guid.NewGuid().ToString()}.tld",
                        Username = Guid.NewGuid().ToString()[..32],
                        Password = Guid.NewGuid().ToString(),
                        DateOfBirth = new(),
                        Consent = true
                    });
                }
                catch (Exception) when (i < attempts) {
                    await Task.Delay(500);
                }
            }
        }
        var client = await _clientProvider.GetAuthenticatedClientAsync(_config.TestInstance, tokenResponse.Token);

        if (!withAutojoinGuilds) {
            await Task.Delay(1000);
            var leaves = (await client.GetJoinedGuilds()).Select(x => client.GetGuild(x.Id).LeaveAsync()).ToList();
            await Task.WhenAll(leaves);
            await Task.Delay(1000);
        }

        return client;
    }

    private static readonly SemaphoreSlim _sharedUserLock = new(1, 1);
    private static AuthenticatedSpacebarClient? _authenticatedSpacebarClient;
    public async Task<AuthenticatedSpacebarClient> GetSharedUser() {
        // ??= is not atomic: parallel test classes would each register a different
        // "shared" user, and whichever ran last wins — later requests in other classes
        // then act as a user that is not a member of their shared guilds.
        await _sharedUserLock.WaitAsync();
        try {
            return _authenticatedSpacebarClient ??= await GetFreshUser();
        }
        finally {
            _sharedUserLock.Release();
        }
    }
}