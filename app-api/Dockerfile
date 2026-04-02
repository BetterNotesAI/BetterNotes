FROM node:20-bookworm

# Install LaTeX and required packages for PDF compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-science \
    texlive-pictures \
    texlive-luatex \
    texlive-xetex \
    lmodern \
    latexmk \
    pandoc \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first so Docker can cache the npm install layer
COPY package*.json tsconfig.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Compile TypeScript — output goes to /dist
RUN npm run build

ENV PORT=4000
EXPOSE 4000

CMD ["node", "dist/server.js"]
