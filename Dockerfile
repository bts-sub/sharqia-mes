# Sharqia MES — تطبيق ساكن (PWA) يُخدَم بـ nginx. لا باك إند: التطبيق يقرأ
# من بيانات mock الآن، ولاحقًا من أودو مباشرةً حسب www/env.js.
FROM nginx:alpine
COPY www /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
