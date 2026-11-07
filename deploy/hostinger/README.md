# Hostinger KVM 2 production profile

Este diretório prepara o Abyssal para uma VPS Hostinger KVM 2 sem alterar o comportamento do jogo.

## Perfil alvo

- 2 vCPU
- 8 GB RAM
- 100 GB NVMe
- 8 TB de largura de banda
- rede de 1 Gbps
- Linux
- datacenter no Brasil

## Arquitetura recomendada

```
Internet
  |
Nginx (TLS, arquivos estáticos, proxy WebSocket)
  |
Node.js 26 LTS
  |-- thread principal: Socket.IO + simulação autoritativa 20 Hz
  |-- libuv threadpool: scrypt assíncrono serializado, filesystem e tarefas nativas
  |-- Worker thread: serialização e snapshots locais de persistência
  |
PostgreSQL externo
```

O servidor do jogo continua sendo uma única autoridade por sala. Não use PM2 cluster ou duas cópias de server.js no mesmo domínio enquanto o roteamento de salas entre processos não estiver implementado. O código atual mantém estado vivo de cada sala em memória.

## Por que não usar 8 GB como heap inteiro

Mais heap não gera FPS. Um heap muito grande pode aumentar pausas de garbage collection. O serviço limita o heap do Node a 2 GB, deixando ampla memória para kernel, page cache, Nginx e crescimento do processo. O limite pode ser aumentado depois de benchmark real.

## Instalação

1. Crie o usuário de serviço `abyssal`.
2. Clone o repositório em `/opt/abyssal`.
3. Instale Node.js 26 LTS, Nginx e Certbot.
4. Copie `abyssal.service` para `/etc/systemd/system/abyssal.service`.
5. Crie `/etc/abyssal/abyssal.env` a partir de `.env.example`, sem colocar segredos no Git.
6. Copie `99-abyssal.conf` para `/etc/sysctl.d/` e execute `sudo sysctl --system`.
7. Use `nginx-main.conf` como referência para o `/etc/nginx/nginx.conf` principal, depois copie `nginx-abyssal.conf` para `/etc/nginx/sites-available/abyssal`, substitua `__ABYSSAL_DOMAIN__`, habilite o site e valide com `nginx -t`.
8. Habilite o serviço com `sudo systemctl enable --now abyssal`.
9. Rode `npm run preflight:hostinger`.
10. Valide `/health` antes de apontar clientes para a VPS.

## Variáveis recomendadas

```env
ABYSSAL_RESOURCE_PROFILE=hostinger-kvm2
ABYSSAL_ASYNC_PERSISTENCE=true
UV_THREADPOOL_SIZE=4
HTTP_BACKLOG=4096
DATABASE_POOL_MAX=5
NODE_ENV=production
```

`DATABASE_URL`, credenciais de pagamentos, e-mail e demais segredos ficam apenas em `/etc/abyssal/abyssal.env`.

## Deploy com rollback

`deploy.sh` atualiza para a branch configurada, instala dependências, executa os testes, reinicia o systemd e valida `/health`. Se qualquer etapa falhar, volta ao commit anterior.

## Escala futura

Com 2 vCPU, a estratégia inicial é manter uma thread principal dedicada à simulação e deixar o segundo núcleo absorver Nginx, TLS, scrypt, filesystem, Worker de persistência e tarefas do sistema. Quando o tempo de tick indicar saturação real do núcleo de simulação, o passo seguinte é sharding de salas entre processos, não aumentar o tickrate de uma única sala.


## Benchmark de capacidade

Com o servidor rodando, execute:

```bash
npm run capacity:sample -- http://127.0.0.1:3000/health 60
```

O sampler coleta CPU, RSS, event-loop lag, tick global e tick por sala. O objetivo não é ocupar 100% da CPU. Para um tick autoritativo de 50 ms, mantenha preferencialmente o p95 de processamento abaixo de 10 ms e event-loop lag p95 abaixo de 20 ms. Compare a mesma cena e quantidade de jogadores no Render e na VPS para medir o ganho real.
