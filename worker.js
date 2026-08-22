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
        // Load practices.json from the same deployed website
        const dataUrl = new URL("/practices.json", request.url);

        const response = await fetch(dataUrl);

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

        const search = query.toLowerCase().trim();
        const postcodeSearch = search
          .replace(/\s+/g, "")
          .toUpperCase();

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

    // Serve the website normally
    return fetch(request);
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
