import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/feis", "/schools"],
      disallow: ["/account", "/marketplace", "/messages", "/orders", "/sell", "/admin", "/mfa", "/api"],
    },
  };
}
