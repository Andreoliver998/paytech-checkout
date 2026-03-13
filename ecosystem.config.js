module.exports = {
  apps: [
    {
      name: "paytech-checkout",
      cwd: "./backend",
      script: "server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
