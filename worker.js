export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/cqc") {
      const query = (url.searchParams.get("q") || "").trim();

      if (!query) {
        return jsonResponse({ locations: [] });
      }

      try {
        // Load the practice database
        const data = await env.ASSETS.fetch(
          new URL("/practices.json", request.url)
        );

        if (!data.ok) {
          return jsonResponse({
            locations: [],
            error: "Could not load practices.json"
          }, 500);
        }

        const practices = await data.json();

        // Normalise the user's search
        const search = query.toLowerCase().trim();
        const postcodeSearch = search.replace(/\s+/g, "");

        // Search ONLY Town/City and Postcode
        const results = practices.filter(practice => {
          const town = String(practice["Town/City"] || "").toLowerCase().trim();
          const postcode = String(practice["Postcode"] || "")
            .toLowerCase()
            .replace(/\s+/g, "");

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
        return jsonResponse({
          locations: [],
          error: "Search failed"
        }, 500);
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
