import type {NextConfig} from "next";

const nextConfig: NextConfig = {
     /* config options here */
     env: {
          NEXT_PUBLIC_API_URL:
               process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
     },
     images: {
          remotePatterns: [
               {
                    protocol: "https",
                    hostname: "**",
               },
               {
                    protocol: "http",
                    hostname: "**",
               },
          ],
     },
};

export default nextConfig;
