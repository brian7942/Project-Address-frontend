/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ["en", "ko"],   // 필요한 언어 목록
    defaultLocale: "en",     // 기본 언어를 영어로
    localeDetection: false,   // 브라우저 언어 자동 감지(원치 않으면 false)
  },
};

export default nextConfig;