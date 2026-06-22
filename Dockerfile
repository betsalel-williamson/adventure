# Cloud deploy MVP (C1): adventure-v2 + Fortran oracle + assist-server
#
# Build (single platform):
#   docker build $(./scripts/cloud-deploy/docker-build-args.sh) -t adventure-cloud .
#
# Multi-arch (linux/amd64 + linux/arm64):
#   docker buildx build --platform linux/amd64,linux/arm64 -t adventure-cloud .
#
# Run:
#   docker run --rm -p 8787:8787 -p 8790:8790 adventure-cloud

FROM node:24-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends gfortran make curl jq \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY adventure.f adventure.dat Makefile .nvmrc ./
COPY adventure-v2 ./adventure-v2
COPY adventure-langgraph/package.json adventure-langgraph/package-lock.json ./adventure-langgraph/
COPY adventure-langgraph/packages ./adventure-langgraph/packages
COPY adventure-langgraph/tsconfig.json ./adventure-langgraph/
COPY scripts/cloud-deploy ./scripts/cloud-deploy

ARG BUILD_GIT_SHA=dev
ARG BUILD_IMAGE_TAG=dev
ARG BUILD_TIME=
ENV ADV_BUILD_GIT_SHA=${BUILD_GIT_SHA} \
    ADV_BUILD_IMAGE_TAG=${BUILD_IMAGE_TAG} \
    ADV_BUILD_TIME=${BUILD_TIME}

RUN make adventure \
  && npm ci --prefix adventure-v2 \
  && npm ci --prefix adventure-langgraph \
  && chmod +x scripts/cloud-deploy/container-entrypoint.sh \
              scripts/cloud-deploy/container-smoke.sh \
              scripts/cloud-deploy/docker-build-args.sh

ENV PORT=8787 \
    HOST=0.0.0.0 \
    ASSIST_SERVER_PORT=8790

EXPOSE 8787 8790

ENTRYPOINT ["./scripts/cloud-deploy/container-entrypoint.sh"]
