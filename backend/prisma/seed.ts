import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

const PRODUCTS = [
     {
          id: "1",
          name: 'MacBook Pro 16"',
          price: 2499.99,
          availableStock: 10,
          thumbnail:
               "https://www.apple.com/newsroom/images/tile-images/Apple_16-inch-MacBook-Pro_111319.jpg.landing-big_2x.jpg",
     },
     {
          id: "2",
          name: 'MacBook Pro 14"',
          price: 1999.99,
          availableStock: 10,
          thumbnail:
               "https://p.turbosquid.com/ts-thumb/T4/sb1pKy/5k/16inchapplemacbookpropackagingbox3dmodel002/jpg/1712821548/1920x1080/fit_q87/a0942df3e17cd92311476fed039fbd24bba53374/16inchapplemacbookpropackagingbox3dmodel002.jpg",
     },
     {
          id: "3",
          name: "Wireless Mouse",
          price: 29.99,
          availableStock: 50,
          thumbnail: "https://m.media-amazon.com/images/I/61OkuiCWbDL.jpg",
     },
     {
          id: "4",
          name: "Mechanical Keyboard",
          price: 129.99,
          availableStock: 25,
          thumbnail:
               "https://m.media-amazon.com/images/I/61pI%2BpxzACL._AC_UF894%2C1000_QL80_.jpg",
     },
     {
          id: "5",
          name: "4K Monitor",
          price: 399.99,
          availableStock: 15,
          thumbnail: "https://i.ytimg.com/vi/n9dE8s4Bzro/maxresdefault.jpg",
     },
     {
          id: "6",
          name: "Bluetooth Earbuds",
          price: 99.99,
          availableStock: 25,
          thumbnail:
               "https://img.drz.lazcdn.com/static/bd/p/3bbaf6e543387097501a42cdb9ba2cad.jpg_960x960q80.jpg_.webp",
     },
];

async function main() {
     console.log("🌱 Seeding database...");

     const upserts = PRODUCTS.map((prod) =>
          prisma.product.upsert({
               where: {id: prod.id},
               update: {
                    name: prod.name,
                    price: prod.price,
                    availableStock: prod.availableStock,
                    thumbnail: prod.thumbnail,
               },
               create: prod,
          })
     );

     const results = await Promise.all(upserts);
     console.log(`✅ Created/Updated ${results.length} products`);
}

main()
     .catch((e) => {
          console.error("❌ Seeding failed:", e);
          process.exit(1);
     })
     .finally(async () => {
          await prisma.$disconnect();
     });
