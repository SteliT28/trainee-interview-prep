export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/cqc") {
      const query = (url.searchParams.get("q") || "").trim();

      if (!query) {
        return jsonResponse({ total: 0, locations: [] });
      }

      try {
        // Get practices.json from the deployed static assets
        const response = await env.ASSETS.fetch(
          new Request(new URL("/practices.json", request.url))
        );

        if (!response.ok) {
          return jsonResponse(
            {
              total: 0,
              locations: [],
              error: "Could not load practices.json"
            },
            500
          );
        }

        const practices = await response.json();

        // Normalise the user's search
        const search = query.toLowerCase().trim();
        const postcodeSearch = search.replace(/\s+/g, "").toUpperCase();

        // Search ONLY Town/City and Postcode
        const results = practices.filter((practice) => {
          const town = String(practice.townCity || "")
            .toLowerCase()
            .trim();

          const postcode = String(practice.postcodeSearch || "")
            .replace(/\s+/g, "")
            .toUpperCase();

          return (
            town === search ||
            postcode === postcodeSearch ||
            postcode.startsWith(postcodeSearch)
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
