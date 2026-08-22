export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/cqc") {
      const cqcUrl =
        "https://api.service.cqc.org.uk/public/v1/locations?perPage=10&page=1";

      const response = await fetch(cqcUrl, {
        headers: {
          "Ocp-Apim-Subscription-Key": env.CQC_API_KEY
        }
      });

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};

