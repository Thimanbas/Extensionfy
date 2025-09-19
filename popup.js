let trackInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  SpotifyControls.loadToken((token) => {
    if (token) {
      mostrarControles();
    } else {
      document.getElementById("login-btn").addEventListener("click", () => {
        SpotifyControls.authenticate();
      });
    }
  });
});

function mostrarControles() {
  document.getElementById("not-logged").style.display = "none";
  document.getElementById("controls").style.display = "block";

  document.getElementById("play").addEventListener("click", SpotifyControls.play);
  document.getElementById("pause").addEventListener("click", SpotifyControls.pause);
  document.getElementById("next").addEventListener("click", SpotifyControls.nextTrack);
  document.getElementById("prev").addEventListener("click", SpotifyControls.previousTrack);
  document.getElementById("search").addEventListener("click", () =>{
     document.querySelector('.musicplayer__search').classList.toggle('hide')
      if(!document.querySelector('.musicplayer__playlist').classList.contains('hide')) document.querySelector('.musicplayer__playlist').classList.toggle('hide') 
   
  });
 





chrome.storage.local.get("capasVisiveis", (result) => {
    let capasVisiveis = result.capasVisiveis;

    aplicarEstadoCapas(capasVisiveis !== false);
});

function aplicarEstadoCapas(visiveis) {
    document.querySelectorAll(".cover").forEach(e => {
        e.classList.toggle('hide', !visiveis);
    });
}

document.getElementById("cover").addEventListener("click", () => {
    chrome.storage.local.get("capasVisiveis", (result) => {
        let novoEstado = !(result.capasVisiveis !== false); 
        chrome.storage.local.set({ capasVisiveis: novoEstado });
        aplicarEstadoCapas(novoEstado);
    });
});

const observer = new MutationObserver(() => {
    chrome.storage.local.get("capasVisiveis", (result) => {
        aplicarEstadoCapas(result.capasVisiveis !== false);
    });
});

observer.observe(document.body, { childList: true, subtree: true });


  atualizarMusicaAtual();

  if (trackInterval) clearInterval(trackInterval);
  trackInterval = setInterval(atualizarMusicaAtual, 5000);
}

async function atualizarMusicaAtual() {
  const track = await SpotifyControls.getCurrentTrack();
  if (track) {
    document.querySelector(".musicplayer__music__name").textContent = `${track.name} - ${track.artists}`;
     document.querySelector(".musicplayer__album__cover").innerHTML = `<img src="${track.albumCover}">`;
  } else {
    document.querySelector(".musicplayer__music__name").textContent = "Nenhuma música tocando";
  }
}


let marqueeInterval; 

function startMarquee(text, selector) {
  const container = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (!container) return;

  if (marqueeInterval) clearInterval(marqueeInterval);

  container.textContent = text;
  if (container.scrollWidth <= container.clientWidth) return;

  let i = 0;
  marqueeInterval = setInterval(() => {
    const displayText = text.slice(i) + " • " + text.slice(0, i);
    container.textContent = displayText;
    i = (i + 1) % text.length;
  }, 200); 
}

async function atualizarMusicaAtual() {
  const track = await SpotifyControls.getCurrentTrack();
  if (track) {
    const fullText = `${track.name} - ${track.artists}`;
    startMarquee(fullText,".musicplayer__music__name");

    document.querySelector(".musicplayer__album__cover").innerHTML =
      `<img src="${track.albumCover} ">`;
  } else {
    document.querySelector(".musicplayer__music__name").textContent =
      "Nenhuma música tocando";
    document.querySelector(".musicplayer__album__cover").innerHTML = "";
    if (marqueeInterval) clearInterval(marqueeInterval);
  }
}

