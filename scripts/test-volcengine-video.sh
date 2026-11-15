
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_SECRET_KEY" \
  -d '{
    "prompt": "第一人称视角果茶宣传广告，seedance牌「苹苹安安」苹果果茶限定款；首帧为图片1，你的手摘下一颗带晨露的阿克苏红苹果，轻脆的苹果碰撞声；2-4 秒：快速切镜，你的手将苹果块投入雪克杯，加入冰块与茶底，用力摇晃，冰块碰撞声与摇晃声卡点轻快鼓点，背景音：「鲜切现摇」；4-6 秒：第一人称成品特写，分层果茶倒入透明杯，你的手轻挤奶盖在顶部铺展，在杯身贴上粉红包标，镜头拉近看奶盖与果茶的分层纹理；6-8 秒：第一人称手持举杯，你将图片2中的果茶举到镜头前（模拟递到观众面前的视角），杯身标签清晰可见，背景音「来一口鲜爽」，尾帧定格为图片2。背景声音统一为女生音色。",
    "duration": 11,
    "ratio": "16:9",
    "generateAudio": true,
    "watermark": false
  }')

echo "响应: $RESPONSE"
echo

# 提取任务 ID
TASK_ID=$(echo "$RESPONSE" | grep -o '"taskId":"[^"]*' | cut -d'"' -f4)

if [ -z "$TASK_ID" ]; then
  echo "错误：创建任务失败"
  echo "$RESPONSE"
  exit 1
fi

echo "任务 ID: $TASK_ID"
echo

# 2. 查询任务状态（轮询）
echo "2. 查询任务状态..."
echo "等待任务完成..."

MAX_RETRIES=40  # 最多等待 2 分钟（40 * 3 秒）
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  TASK_RESPONSE=$(curl -s -X GET "$API_URL?taskId=$TASK_ID" \
    -H "x-admin-key: $ADMIN_SECRET_KEY")
  
  STATUS=$(echo "$TASK_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  echo "[$RETRY_COUNT/$MAX_RETRIES] 任务状态: $STATUS"
  
  if [ "$STATUS" = "succeeded" ]; then
    echo
    echo "任务成功！"
    echo "$TASK_RESPONSE" | grep -o '"result":{[^}]*' || echo "$TASK_RESPONSE"
    exit 0
  fi
  
  if [ "$STATUS" = "failed" ] || [ "$STATUS" = "canceled" ]; then
    echo
    echo "任务失败"
    echo "$TASK_RESPONSE"
    exit 1
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 3
done

echo
echo "超时：任务未在规定时间内完成"
echo "$TASK_RESPONSE"
exit 1
