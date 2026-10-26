/**
 * [파일 5-1] ecosystem.config.js
 * 역할: 큐텍(QOOTEC) 산업용 미니 PC 현장 운영용 PM2 백그라운드 무중단 서비스 설정
 * 사용법: pm2 start ecosystem.config.js && pm2 save
 */

module.exports = {
  apps: [
    {
      name: "acsc-plc-bridge",
      script: "./server/plc-ws-bridge.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PLC_IP: "192.168.0.50",
        PLC_PROTOCOL: "MODBUS",
        PLC_MODBUS_PORT: 502,
        PLC_XGT_PORT: 2004,
        BRIDGE_PORT: 4000,
      },
      env_sim: {
        NODE_ENV: "development",
        PLC_IP: "127.0.0.1",
        PLC_PROTOCOL: "MODBUS",
        PLC_MODBUS_PORT: 8502,
        BRIDGE_PORT: 4000,
      },
    },
    {
      name: "acsc-web-ui",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
