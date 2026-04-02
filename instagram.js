require("dotenv").config();
const axios = require("axios");
const fs    = require("fs");

const GRAPH = "https://graph.facebook.com/v18.0";

// ===== OAUTH URL =====
function buildOAuthURL(state) {
  const params = new URLSearchParams({
    client_id:     process.env.IG_APP_ID,
    redirect_uri:  process.env.IG_REDIRECT_URI,
    scope:         "instagram_content_publish,instagram_basic,pages_read_engagement,pages_show_list",
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
}

// ===== EXCHANGE CODE → LONG-LIVED TOKEN =====
async function exchangeCodeForLongLivedToken(code) {
  // 1. Código → token de corta duración
  const shortRes = await axios.get(`${GRAPH}/oauth/access_token`, {
    params: {
      client_id:     process.env.IG_APP_ID,
      client_secret: process.env.IG_APP_SECRET,
      redirect_uri:  process.env.IG_REDIRECT_URI,
      code,
    },
  });
  const shortToken = shortRes.data.access_token;

  // 2. Token corto → token largo (60 días)
  const longRes = await axios.get(`${GRAPH}/oauth/access_token`, {
    params: {
      grant_type:        "fb_exchange_token",
      client_id:         process.env.IG_APP_ID,
      client_secret:     process.env.IG_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  });
  const { access_token, expires_in } = longRes.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000);
  return { accessToken: access_token, expiresAt };
}

// ===== OBTENER ID Y USERNAME DE LA CUENTA IG BUSINESS =====
async function getInstagramBusinessAccountId(accessToken) {
  const res = await axios.get(`${GRAPH}/me/accounts`, {
    params: {
      fields:       "id,name,instagram_business_account",
      access_token: accessToken,
    },
  });

  const pages = res.data.data || [];
  for (const page of pages) {
    if (page.instagram_business_account?.id) {
      const igId = page.instagram_business_account.id;

      // Obtener username de la cuenta IG
      const igRes = await axios.get(`${GRAPH}/${igId}`, {
        params: { fields: "username", access_token: accessToken },
      });

      return { igId, igUsername: igRes.data.username || igId };
    }
  }

  throw new Error(
    "No se encontró ninguna cuenta de Instagram Business/Creator vinculada a tus páginas de Facebook. " +
    "Asegúrate de que la página de Facebook está conectada a una cuenta IG Business o Creator."
  );
}

// ===== PUBLICAR EN STORIES =====
async function publishStory(instagramId, accessToken, imageUrl) {
  // 1. Crear contenedor
  const containerRes = await axios.post(
    `${GRAPH}/${instagramId}/media`,
    null,
    {
      params: {
        image_url:    imageUrl,
        media_type:   "IMAGE",
        is_story:     true,
        access_token: accessToken,
      },
    }
  );
  const containerId = containerRes.data.id;

  // 2. Esperar a que el contenedor esté listo (polling)
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await axios.get(`${GRAPH}/${containerId}`, {
      params: { fields: "status_code", access_token: accessToken },
    });
    if (statusRes.data.status_code === "FINISHED") break;
    if (statusRes.data.status_code === "ERROR") {
      throw new Error("El contenedor de media falló en Instagram.");
    }
  }

  // 3. Publicar
  const publishRes = await axios.post(
    `${GRAPH}/${instagramId}/media_publish`,
    null,
    {
      params: {
        creation_id:  containerId,
        access_token: accessToken,
      },
    }
  );
  const mediaId = publishRes.data.id;

  // 4. Obtener permalink
  const permalinkRes = await axios.get(`${GRAPH}/${mediaId}`, {
    params: { fields: "permalink", access_token: accessToken },
  });
  const postUrl = permalinkRes.data.permalink || `https://www.instagram.com/`;

  return { mediaId, postUrl };
}

// ===== BORRAR ARCHIVO TEMPORAL (tras 10 min) =====
function cleanupTempFile(filepath) {
  setTimeout(() => {
    fs.unlink(filepath, err => {
      if (err) console.error("Cleanup temp fallido:", filepath, err.message);
      else     console.log("Temp borrado:", filepath);
    });
  }, 10 * 60 * 1000);
}

module.exports = {
  buildOAuthURL,
  exchangeCodeForLongLivedToken,
  getInstagramBusinessAccountId,
  publishStory,
  cleanupTempFile,
};
