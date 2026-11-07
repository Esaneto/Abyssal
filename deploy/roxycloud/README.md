# RoxyCloud Ryzen 4GB production profile

Perfil de produção do Abyssal para a VPS RoxyCloud Ryzen 7 de 4 GB.

## Perfil alvo

- 2 vCPU Ryzen de alto clock
- 4 GB RAM
- 40 GB NVMe
- KVM
- IPv4 dedicado
- Anti-DDoS
- Linux
- datacenter em Presidente Prudente, SP

## Arquitetura

```
Internet
  |
Nginx
  |-- TLS
  |-- arquivos estáticos
  |-- proxy WebSocket
  |
Node.js 26 LTS
  |-- thread principal: Socket.IO + simulação autoritativa 20 Hz
  |-- libuv: crypto, filesystem e tarefas nativas
  |-- Worker thread: serialização e snapshots locais
  |
PostgreSQL externo
```

O Abyssal continua com uma única autoridade por sala. Não use PM2 cluster nem duas instâncias independentes de `server.js` no mesmo domínio antes de existir sharding explícito de salas.

## Memória

A VPS tem 4 GB, mas o Node não deve receber os 4 GB como heap.

O serviço usa:

```
--max-old-space-size=1536
MemoryHigh=3072M
MemoryMax=3584M
```

Isso reserva memória suficiente para kernel, page cache, Nginx, TLS, Worker Thread e buffers de rede, reduzindo risco de swap e pausas longas de garbage collection.

## Dois vCPU

O perfil usa `UV_THREADPOOL_SIZE=4`, não 8. O objetivo é preservar um núcleo rápido para o loop autoritativo e permitir que o segundo núcleo absorva crypto, Worker, Nginx e I/O sem criar excesso de competição.

Quando o tick p95 indicar saturação real, o próximo passo é sharding de salas entre processos, não aumentar indiscriminadamente o número de threads.

## Instalação

1. Crie o usuário `abyssal`.
2. Clone o repositório em `/opt/abyssal`.
3. Instale Node.js 26 LTS, Nginx e Certbot.
4. Crie `/etc/abyssal/abyssal.env` com os segredos fora do Git.
5. Copie `abyssal.service` para `/etc/systemd/system/abyssal.service`.
6. Copie `99-abyssal.conf` para `/etc/sysctl.d/99-abyssal.conf` e rode `sudo sysctl --system`.
7. Use `nginx-main.conf` como referência para o Nginx principal.
8. Instale `nginx-abyssal.conf` em `/etc/nginx/sites-available/abyssal`, substituindo `__ABYSSAL_DOMAIN__`.
9. Rode `sudo nginx -t`.
10. Rode `npm run preflight:roxycloud`.
11. Habilite com `sudo systemctl enable --now abyssal`.
12. Valide `/health` antes de trocar o endpoint dos clientes.

## Variáveis recomendadas

```env
ABYSSAL_RESOURCE_PROFILE=roxycloud-ryzen4
ABYSSAL_ASYNC_PERSISTENCE=true
UV_THREADPOOL_SIZE=4
HTTP_BACKLOG=4096
DATABASE_POOL_MAX=5
NODE_ENV=production
```

`DATABASE_URL`, chaves de pagamento, e-mail e demais segredos ficam somente em `/etc/abyssal/abyssal.env`.

## Benchmark

Antes de colocar jogadores reais:

```bash
npm run capacity:sample -- http://127.0.0.1:3000/health 60
```

Metas iniciais:

- simulação autoritativa: 20 Hz
- orçamento de tick: 50 ms
- tick p95 desejável: abaixo de 10 ms
- event-loop lag p95 desejável: abaixo de 20 ms
- RSS em carga: manter ampla folga abaixo dos 4 GB

Faça o mesmo cenário no Render e na RoxyCloud para comparar tick, jitter, CPU e event-loop lag com dados reais.
