const fs = require("fs");

const username = "gsumithub";

async function generate() {
  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "User-Agent": username,
    Accept: "application/vnd.github+json"
  };

  // Fetch user
  const userRes = await fetch(`https://api.github.com/users/${username}`, {
    headers,
  });

  if (!userRes.ok) {
    console.log("User API failed:", await userRes.text());
    process.exit(1);
  }

  const user = await userRes.json();

  // Fetch repos
  const reposRes = await fetch(
    `https://api.github.com/users/${username}/repos?per_page=100`,
    { headers }
  );

  if (!reposRes.ok) {
    console.log("Repos API failed:", await reposRes.text());
    process.exit(1);
  }

  const repos = await reposRes.json();

  if (!Array.isArray(repos)) {
    console.log("Repos is not array:", repos);
    process.exit(1);
  }

  const totalStars = repos.reduce(
    (acc, repo) => acc + repo.stargazers_count,
    0
  );

  const totalForks = repos.reduce(
    (acc, repo) => acc + repo.forks_count,
    0
  );

  const svg = `
<svg width="900" height="280" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" rx="20" fill="#0d1117"/>
  <rect x="0" y="0" width="100%" height="8" fill="#00c6ff"/>

  <text x="40" y="60" fill="#ffffff" font-size="28" font-family="Verdana">
    ${user.name || username}
  </text>

  <text x="40" y="100" fill="#58a6ff" font-size="18">
    Public Repositories: ${user.public_repos}
  </text>

  <text x="40" y="135" fill="#58a6ff" font-size="18">
    Followers: ${user.followers}
  </text>

  <text x="40" y="170" fill="#58a6ff" font-size="18">
    Total Stars: ${totalStars}
  </text>

  <text x="40" y="205" fill="#58a6ff" font-size="18">
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
