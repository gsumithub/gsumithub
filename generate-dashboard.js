const fs = require("fs");

const username = "gsumithub";

async function generate() {
  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "User-Agent": username,
  };

  // Fetch user data
  const userRes = await fetch(`https://api.github.com/users/${username}`, {
    headers,
  });
  const user = await userRes.json();

  // Fetch repos
  const reposRes = await fetch(
    `https://api.github.com/users/${username}/repos?per_page=100`,
    { headers }
  );
  const repos = await reposRes.json();

  const totalStars = repos.reduce((acc, repo) => acc + repo.stargazers_count, 0);
  const totalForks = repos.reduce((acc, repo) => acc + repo.forks_count, 0);

  const svg = `
<svg width="900" height="280" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00c6ff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0072ff;stop-opacity:1" />
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" rx="20" fill="#0d1117"/>
  <rect x="0" y="0" width="100%" height="8" fill="url(#grad)" />

  <text x="40" y="60" fill="#ffffff" font-size="28" font-family="Verdana">
    ${user.name || username}
  </text>

  <text x="40" y="95" fill="#8b949e" font-size="16" font-family="Verdana">
    Custom GitHub Dashboard
  </text>

  <text x="40" y="140" fill="#58a6ff" font-size="18" font-family="Verdana">
    Public Repositories: ${user.public_repos}
  </text>

  <text x="40" y="175" fill="#58a6ff" font-size="18" font-family="Verdana">
    Followers: ${user.followers}
  </text>

  <text x="40" y="210" fill="#58a6ff" font-size="18" font-family="Verdana">
    Total Stars: ${totalStars}
  </text>

  <text x="40" y="245" fill="#58a6ff" font-size="18" font-family="Verdana">
    Total Forks: ${totalForks}
  </text>
</svg>
`;

  if (!fs.existsSync("stats")) {
    fs.mkdirSync("stats");
  }

  fs.writeFileSync("stats/custom-dashboard.svg", svg);
}

generate();
