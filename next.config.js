const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configurações adicionais aqui se necessário
};

module.exports = withNextIntl(nextConfig);
