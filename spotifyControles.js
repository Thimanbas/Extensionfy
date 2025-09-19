const CLIENT_ID = "9be0143d414042f695fa007206967cd7";
const REDIRECT_URI = chrome.runtime.getURL("callback.html");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchContainer = document.querySelector(".searchbar__container__content");
const typeCheckboxes = document.querySelectorAll(".search__types input[type='checkbox']");


let accessToken = null;
let refreshToken = null;



window.SpotifyControls = {
  authenticate,
  exchangeCodeForToken,
  loadToken,
  play,
  pause,
  nextTrack,
  previousTrack,
  playUri,
  playContext,
  addToQueue,
  getCurrentTrack,
  search,
  spotifyRequest 
};





searchBtn.addEventListener("click", async () => {
  const query = searchInput.value.trim();
  const selectedTypes = Array.from(typeCheckboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  if (!query || selectedTypes.length === 0) return;

  searchContainer.innerHTML = "";

  for (const type of selectedTypes) {
    const results = await SpotifyControls.search(query, type);

    results.forEach(item => {
      const div = document.createElement("div");
      div.classList.add("search-item");
      div.innerHTML = `
      <div class="cover mini__cover"><img src="${item.image}" alt="${item.name}" width="50"></div>
        
        <div class="scroll-text item__name" ><span >${item.name}</span></div>
        <small class="scroll-text item__artist"><span >${item.artists || item.owner || item.publisher}</span></small>
      `;
    
      const playNowBtn = document.createElement("button");
      playNowBtn.textContent = "▶";
      div.appendChild(playNowBtn);

      if (item.uri.startsWith("spotify:track") || item.uri.startsWith("spotify:episode")) {
 
        const addQueueBtn = document.createElement("button");
        addQueueBtn.textContent = "➕";
        div.appendChild(addQueueBtn);

        playNowBtn.addEventListener("click", () => SpotifyControls.playUri(item.uri));
        addQueueBtn.addEventListener("click", () => SpotifyControls.addToQueue(item.uri));
      } else {
        playNowBtn.addEventListener("click", () => SpotifyControls.playContext(item.uri));
      }

      searchContainer.appendChild(div);
    });
  }
});
document.getElementById("list").addEventListener("click", async () => {
  const container = document.querySelector(".musicplayer__album__cover__content");
   document.querySelector('.musicplayer__playlist').classList.toggle('hide')
   if(!document.querySelector('.musicplayer__search').classList.contains('hide')) document.querySelector('.musicplayer__search').classList.toggle('hide') 
   
  if (!container) return;

  container.innerHTML = "";

  const data = await SpotifyControls.spotifyRequest("me/playlists", "GET");
  if (!data || !data.items) return;

  data.items.forEach(playlist => {
    const div = document.createElement("div");
    div.classList.add("search-item");
    div.innerHTML = `
      <div class="cover mini__cover">
        <img src="${playlist.images[0]?.url || 'default-image.jpg'}" alt="${playlist.name}" width="50">
      </div>
      <div class="scroll-text item__name"><span>${playlist.name}</span></div>
      <small class="scroll-text item__artist"><span>${playlist.owner?.display_name || "Desconhecido"}</span></small>
    `;

    const playNowBtn = document.createElement("button");
    playNowBtn.textContent = "▶";
    div.appendChild(playNowBtn);

    playNowBtn.addEventListener("click", () => {
      SpotifyControls.playContext(playlist.uri);
    });

    container.appendChild(div);
  });
});

async function generateCodeVerifier() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(arrayBuffer) {
  return btoa(String.fromCharCode(...arrayBuffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function authenticate() {
  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  chrome.storage.local.set({ spotify_code_verifier: codeVerifier });

  const scope = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "playlist-read-private"
  ].join(" ");

  const authUrl = `https://accounts.spotify.com/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${codeChallenge}`;

  chrome.tabs.create({ url: authUrl });
}

async function exchangeCodeForToken(code, codeVerifier) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const data = await res.json();
  if (data.access_token) {
    accessToken = data.access_token;
    refreshToken = data.refresh_token;

    chrome.storage.local.set({
      spotify_access_token: accessToken,
      spotify_refresh_token: refreshToken
    });

    console.log("✅ Token obtido:", accessToken);
  } else {
    console.error("Erro ao trocar code por token:", data);
  }
}

async function refreshAccessToken() {
  if (!refreshToken) {
    const stored = await chrome.storage.local.get("spotify_refresh_token");
    refreshToken = stored.spotify_refresh_token;
    if (!refreshToken) {
      console.error("Nenhum refresh_token disponível.");
      return false;
    }
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const data = await res.json();
  if (data.access_token) {
    accessToken = data.access_token;
    chrome.storage.local.set({ spotify_access_token: accessToken });
    console.log("🔄 Token renovado.");
    return true;
  } else {
    console.error("Erro ao renovar token:", data);

    if (data.error === "invalid_grant") {
      console.warn("🔴 Refresh token inválido. Reautenticando...");
      chrome.storage.local.remove(
        ["spotify_access_token", "spotify_refresh_token"],
        () => {
          authenticate();
        }
      );
    }
    return false;
  }
}

function loadToken(callback) {
  chrome.storage.local.get(
    ["spotify_access_token", "spotify_refresh_token"],
    (result) => {
      accessToken = result.spotify_access_token || null;
      refreshToken = result.spotify_refresh_token || null;
      if (callback) callback(accessToken);
    }
  );
}

async function spotifyRequest(endpoint, method = "GET", body = null, retry = true) {
  if (!accessToken) {
    console.error("Token de acesso não encontrado.");
    return;
  }

  const res = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
    method,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : null
  });

  if (res.status === 401 && retry) {
    const renewed = await refreshAccessToken();
    if (renewed) {
      return spotifyRequest(endpoint, method, body, false);
    }
  }

  if (!res.ok) {
    const errText = await res.clone().text();
    console.error("Erro Spotify:", errText);
    return null;
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  } else {
    return {};
  }
}

function play() {
  return spotifyRequest("me/player/play", "PUT");
}

function pause() {
  return spotifyRequest("me/player/pause", "PUT");
}

function nextTrack() {
  return spotifyRequest("me/player/next", "POST");
}

function previousTrack() {
  return spotifyRequest("me/player/previous", "POST");
}

function playUri(uri) {
  return spotifyRequest("me/player/play", "PUT", { uris: [uri] });
}
function list() {
  return 0
}

async function search(query, type = "track") {
  if (!query) return [];

  const data = await spotifyRequest(`search?q=${encodeURIComponent(query)}&type=${type}&limit=10`);
  if (!data) return [];

  let items = [];

  if (type === "track" && data.tracks?.items) {
    items = data.tracks.items
      .filter(track => track) 
      .map(track => ({
        name: track?.name || "Sem título",
        artists: track?.artists?.map(a => a.name).join(", ") || "Desconhecido",
        image: track?.album?.images?.[0]?.url || "default-image.jpg",
        uri: track?.uri || ""
      }));
  } 
  
  else if (type === "playlist" && data.playlists?.items) {
    items = data.playlists.items
      .filter(playlist => playlist)
      .map(playlist => ({
        name: playlist?.name || "Sem título",
        owner: playlist?.owner?.display_name || "Desconhecido",
        image: playlist?.images?.[0]?.url || "default-image.jpg",
        uri: playlist?.uri || ""
      }));
  } 
  
  else if (type === "show" && data.shows?.items) { 
    items = data.shows.items
      .filter(show => show)
      .map(show => ({
        name: show?.name || "Sem título",
        publisher: show?.publisher || "Desconhecido",
        image: show?.images?.[0]?.url || "default-image.jpg",
        uri: show?.uri || ""
      }));
  } 
  
  else if (type === "episode" && data.episodes?.items) {
    items = data.episodes.items
      .filter(ep => ep)
      .map(ep => ({
        name: ep?.name || "Sem título",
        publisher: ep?.show?.publisher || "Desconhecido",
        image: ep?.images?.[0]?.url || "default-image.jpg",
        uri: ep?.uri || ""
      }));
  }

  return items;
}

function addToQueue(uri) {
  return spotifyRequest(`me/player/queue?uri=${encodeURIComponent(uri)}`, "POST");
}




async function getCurrentTrack() {
  const data = await spotifyRequest("me/player/currently-playing");
  if (!data || !data.item) return null;
  return {
    id: data.item.id,
    name: data.item.name,
    artists: data.item.artists.map(a => a.name).join(", "),
    albumCover: data.item.album.images[0]?.url || null
  };
}
function addToQueue(uri) {
  return spotifyRequest(`me/player/queue?uri=${encodeURIComponent(uri)}`, "POST");
}

function playContext(contextUri) {
  return spotifyRequest("me/player/play", "PUT", { context_uri: contextUri });
}


const checkboxes = document.querySelectorAll('.search-type');

  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        checkboxes.forEach(box => {
          if (box !== checkbox) box.checked = false;
        });
      }
    });
  });



