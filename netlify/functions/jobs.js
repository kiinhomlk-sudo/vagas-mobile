const { getStore } = require("@netlify/blobs");

exports.handler = async function() {
  try {
    const store = getStore("vagas-mobile-data");
    const data = await store.get("jobs", { type: "json" });

    if (!data) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          updatedAt: null,
          total: 0,
          jobs: [],
          message: "Jobs are not available yet."
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: "Could not load jobs."
      })
    };
  }
};
