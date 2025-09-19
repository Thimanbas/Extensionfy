(async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) {
    console.error("Nenhum code recebido no callback.");
    return;
  }
  chrome.storage.local.get("spotify_code_verifier", async (result) => {
    const codeVerifier = result.spotify_code_verifier;
    if (!codeVerifier) {
      console.error("Nenhum code_verifier encontrado no storage.");
      return;
    }

    await SpotifyControls.exchangeCodeForToken(code, codeVerifier);

    window.close();
  });
})();
