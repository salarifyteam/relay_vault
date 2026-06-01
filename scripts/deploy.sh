#!/usr/bin/env bash
# Relay 배포는 2단이다: vault.relayservice.im → Firebase Hosting(CDN) → Cloud Run.
# gcloud 만 돌리면 Cloud Run 엔 올라가도 도메인은 옛 캐시를 계속 내보낸다.
# 그래서 이 스크립트가 두 단계를 모두 강제하고, 캐시를 우회해서 "도메인이
# 진짜 새 버전을 내보내는지"까지 검증한다. 검증이 실패하면 0이 아닌 코드로
# 죽으므로 "배포된 척"이 불가능하다.
set -euo pipefail

REGION="asia-northeast3"
SERVICE="relay-pay"
DOMAIN="https://vault.relayservice.im"

echo "▶ 1/3  Cloud Run 배포 (gcloud run deploy ${SERVICE})"
gcloud run deploy "${SERVICE}" --source . --region "${REGION}" --quiet

echo "▶ 2/3  Firebase Hosting 재배포 (도메인 CDN 캐시 갱신)"
firebase deploy --only hosting

# 검증 전략: 오리진(Cloud Run 직접 URL)이 내보내는 랜딩 HTML 의 해시와,
# 도메인의 캐시-우회 응답 HTML 의 해시를 비교한다. 같으면 도메인이 곧 오리진
# (= 새 버전)이고, 다르면 도메인이 아직 옛 캐시를 내보내는 것이다. 콘텐츠가
# 뭐든(build-id 노출 여부와 무관) 항상 맞는 비교다.
RUN_URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" \
  --format='value(status.url)')"
echo "▶ 3/3  검증: 도메인 HTML == 오리진 HTML 인지 (캐시 우회)"

ORIGIN_HASH="$(curl -fsS "${RUN_URL}/" | shasum | cut -d' ' -f1)"

# 캐시를 우회하려고 매번 다른 쿼리스트링을 붙인다 → CDN MISS → 오리진 직접.
# 전파 지연이 있을 수 있으니 일치할 때까지 최대 ~30초 재시도한다.
DOMAIN_HASH=""
for attempt in 1 2 3 4 5 6; do
  BUST="$(node -e 'process.stdout.write(process.hrtime.bigint().toString())')"
  DOMAIN_HASH="$(curl -fsS "${DOMAIN}/?deploycheck=${BUST}" | shasum | cut -d' ' -f1)"
  [ "${DOMAIN_HASH}" = "${ORIGIN_HASH}" ] && break
  echo "  …도메인이 아직 갱신 전 (${attempt}/6) — 5초 후 재시도"
  sleep 5
done

if [ "${DOMAIN_HASH}" = "${ORIGIN_HASH}" ]; then
  echo "✓ 배포 완료 — ${DOMAIN} 가 오리진과 동일한 HTML(${ORIGIN_HASH:0:12}) 을 서빙함."
  echo "  (브라우저에서 옛 화면이면 로컬 캐시다 → Cmd+Shift+R)"
else
  echo "✗ 검증 실패: ${DOMAIN} HTML(${DOMAIN_HASH:0:12}) ≠ 오리진(${ORIGIN_HASH:0:12})." >&2
  echo "  Cloud Run 엔 올라갔지만 도메인 캐시가 안 풀렸다. firebase 재배포를 확인하라." >&2
  exit 1
fi
