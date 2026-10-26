# Portfolio · Timothée Campos

Site estático (HTML, CSS e JavaScript puros, sem build e sem dependências), pronto para o GitHub Pages.

## Publicar no GitHub Pages
1. Crie um repositório (por exemplo `thempos.github.io`) e envie todo o conteúdo desta pasta.
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Em um ou dois minutos o site fica no ar em `https://thempos.github.io`.

Para testar no computador, rode um servidor local na pasta (o WebGL não carrega imagens via `file://`):

```
python3 -m http.server 8000
```

e abra `http://localhost:8000`.

## Estrutura
| Arquivo | O que faz |
| --- | --- |
| `index.html` | Conteúdo em português (o inglês fica em `js/i18n.js`) |
| `css/style.css` | Visual: tokens de cor e tipo, liquid glass, moldura dourada, salas |
| `js/core.js` | Estado compartilhado: ponteiro, scroll, um único loop de animação, divisão de letras |
| `js/i18n.js` | PT/EN: letras em comum viajam até o novo lugar, o resto é soprado pelo vento |
| `js/glass.js` | Refração do liquid glass (mapa de deslocamento por painel) e brilho da borda |
| `js/gallery.js` | Fundo em WebGL: trama da tela, craquelado, verniz, holofote, lupa, ondas e dissolve dourado |
| `js/trail.js` | Trilha dourada em SVG que se desenha com o scroll |
| `js/motion.js` | Entrada, revelações, letras levadas pelo vento, botões magnéticos, tilt, nav |
| `js/main.js` | Copiar e-mail e apontar o botão de currículo para o PDF do idioma ativo |
| `assets/` | Pinturas, foto e currículos |

## Trocar conteúdo
- **Textos em português:** direto no `index.html`.
- **Textos em inglês:** no objeto `EN` em `js/i18n.js`, usando a mesma chave do atributo `data-i18n`.
- **Pinturas:** substitua `assets/adam.jpg` e `assets/venus.jpg` mantendo os nomes. O enquadramento de cada sala fica em `SHOTS`, em `js/gallery.js`.
- **Foto:** `assets/me.jpg` (proporção 3:4).
- **Currículos:** `assets/curriculo-timothee-campos-pt.pdf` e `assets/resume-timothee-campos-en.pdf`. Há um botão só: ele baixa o PDF do idioma que estiver na tela (o mapa fica em `CV`, em `js/main.js`).

## Desempenho
- O fundo em WebGL só desenha um quadro quando algo muda (rolagem, mouse, ondas ou o dissolve a cada 9 s). Com a página parada, nada é redesenhado.
- A trilha dourada é cortada em trechos de uns 300 px, então desenhá-la repinta só o trecho que está crescendo.
- O brilho da borda do vidro acompanha o mouse só nos painéis perto dele; os outros se ajustam quando a página para.

## Compatibilidade
- A refração real do liquid glass aparece em navegadores Chromium (Chrome, Edge, Arc, Brave). Safari e Firefox mostram o vidro fosco com a mesma borda de luz.
- Sem WebGL2, o fundo vira as duas imagens trocando com fade.
- Com "reduzir movimento" ativado no sistema, as animações são desligadas.
