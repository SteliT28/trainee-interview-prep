export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/cqc") {
      const query = (url.searchParams.get("q") || "").trim();

      if (!query) {
        return jsonResponse({
          total: 0,
          locations: []
        });
      }

      try {
        // Load the practice database from Cloudflare Assets
        const practicesResponse = await env.ASSETS.fetch(
          new Request(new URL("/practices.json", request.url))
        );

        if (!practicesResponse.ok) {
          return jsonResponse(
            {
              total: 0,
              locations: [],
              error: "Could not load practices.json"
            },
            500
          );
        }

        const practices = await practicesResponse.json();

        const search = query.toLowerCase().trim();

        // Normalise postcode search:
        // N9 0AB → N90AB
        // n9 0ab → N90AB
        const postcodeQuery = search
          .replace(/\s+/g, "")
          .toUpperCase();

        // Search ONLY by Town/City and Postcode
        const results = practices.filter((practice) => {
          const town = String(practice.townCity || "")
            .toLowerCase()
            .trim();

          const postcode = String(practice.postcodeSearch || "")
            .replace(/\s+/g, "")
            .toUpperCase();

          return (
            town === search ||
            postcode === postcodeQuery ||
            postcode.startsWith(postcodeQuery)
          );
        });

        return jsonResponse({
          total: results.length,
          locations: results
        });

      } catch (error) {
        return jsonResponse(
          {
            total: 0,
            locations: [],
            error: error.message || String(error)
          },
          500
        );
      }
    }

    // Serve the website and other static files
    return env.ASSETS.fetch(request);
  }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
