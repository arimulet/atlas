
async function run() {
  const res = await fetch("http://localhost:3000/api/imports/sokker-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: "fake", password: "fake" })
  });
  
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}

run();
