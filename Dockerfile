# ==========================================
# Estágio 1: Build da aplicação React + Vite
# ==========================================
FROM node:20-alpine AS build

WORKDIR /app

# Copia arquivos de definição de dependências
COPY package*.json ./

# Instala todas as dependências do projeto de forma mais resiliente
RUN npm install

# Copia todo o restante dos arquivos do projeto
COPY . .

# Compila o projeto gerando os arquivos estáticos indexados no diretório /dist
RUN npm run build

# ==========================================
# Estágio 2: Ambiente de Produção com Nginx
# ==========================================
FROM nginx:1.25-alpine

# Remove a página default do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia a configuração personalizada do Nginx para suportar SPA routes
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos gerados no build para a pasta pública do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Porta padrão exposta pelo contêiner
EXPOSE 80

# Inicia o Nginx em primeiro plano (foreground)
CMD ["nginx", "-g", "daemon off;"]
