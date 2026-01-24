const fs = require("fs");
const fetch = require("node-fetch");

const username = "gsumithub";
const token = process.env.GH_TOKEN;

async function fetchUser() {
  const res = await fetch(`https://api.github.com/users/${username}`, {
    headers: { Authorization: `token ${token}` },
  });
  return res.json();
}

async function generate() {
  const user = await fetchUser();

  const svg = `
<svg width="900" height="420" viewBox="0 0 900 420" xmlns="http://www.w3.org/2000/svg">
<style>
  .title { fill: #ffffff; font-size: 32px; font-weight: bold; }
  .subtitle { fill: #9ca3af; font-size: 18px; }
  .big { fill: #22c55e; font-size: 48px; font-weight: bold; }
  .label { fill: #d1d5db; font-size: 16px; }
  .small { fill: #6b7280; font-size: 14px; }
</style>

<rect width="100%" height="100%" rx="20" fill="#0f172a"/>

<text x="60" y="80" class="title">Sumit Kumar</text>
<text x="60" y="110" class="subtitle">MERN Stack Developer</text>

<text x="60" y="200" class="label">Public Repositories</text>
<text x="60" y="240" class="big">${user.public_repos}</text>

<text x="60" y="310" class="label">Followers</text>
<text x="60" y="350" class="big">${user.followers}</text>

<text x="600" y="380" class="small">
Updated: ${new Date().toDateString()}
</text>
</svg>
`;

  fs.writeFileSync("stats/custom-dashboard.svg", svg);
}

generate();
