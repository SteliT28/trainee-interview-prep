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
        const postcodeQuery = search.replace(/\s+/g, "").toUpperCase();

        // Search ONLY townCity and postcode (postcodeSearch is the
        // pre-normalised, space-free, uppercase postcode from practices.json)
        const results = practices.filter(practice => {
          const town = String(practice.townCity || "").toLowerCase().trim();
          const postcode = String(practice.postcodeSearch || "");

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
  return jsonResponse({
    locations: [],
    error: error.message || String(error)
  }, 500);
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
