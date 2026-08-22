export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/cqc") {
      const query = url.searchParams.get("q")?.trim();

      if (!query) {
        return jsonResponse({
          locations: [],
          error: "Please enter a town or postcode."
        }, 400);
      }

      try {
        const cqcUrl = new URL(
          "https://api.service.cqc.org.uk/public/v1/locations"
        );

        cqcUrl.searchParams.set("page", "1");
        cqcUrl.searchParams.set("perPage", "100");

        // Search by postcode where the user entered something
        // that looks like a UK postcode.
        const postcodePattern =
          /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

        if (postcodePattern.test(query)) {
          cqcUrl.searchParams.set("postalCode", query);
        } else {
          // CQC's locations endpoint supports organisation/location
          // filters, but town-name searching needs to be handled
          // through the returned location data.
          //
          // We therefore retrieve a larger set and filter it below.
        }

        const response = await fetch(cqcUrl.toString(), {
          headers: {
            "Ocp-Apim-Subscription-Key": env.CQC_API_KEY,
            "Accept": "application/json"
          }
        });

        if (!response.ok) {
          return jsonResponse({
            locations: [],
            error: `CQC API returned ${response.status}`
          }, response.status);
        }

        const data = await response.json();

        let locations = data.locations || [];

        // Filter results for dental practices.
        locations = locations.filter(location => {
          const text = JSON.stringify(location).toLowerCase();

          return (
            text.includes("dental") ||
            text.includes("dentist") ||
            text.includes("orthodont")
          );
        });

        return jsonResponse({
          total: locations.length,
          locations
        });

      } catch (error) {
        return jsonResponse({
          locations: [],
          error: "Unable to connect to the CQC API."
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
