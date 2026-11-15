import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';
import { S3Storage } from 'coze-coding-dev-sdk';

/**
 * 创建音色克隆
 * 
 * POST /api/zhipu/voice-clone/create
 * Body: {
 *   audioData: string,     // 音频文件Base64（最少3秒）
 *   voiceName: string,     // 音色名称
 *   fileName?: string,     // 文件名（可选）
 *   contentType?: string,  // 文件类型（可选，默认 audio/mp3）
 *   duration?: number,     // 音频时长（秒，可选）
 * }
 * 
 * 流程：
 * 1. 上传音频样本到对象存储
 * 2. 调用智谱API创建音色克隆
 * 3. 保存音色信息到数据库
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    
    // 检查智谱API是否配置
    const configured = await isZhipuConfiguredForUser(userId);
    if (!configured) {
      return NextResponse.json(
        { error: '智谱API未配置，请在方案设置中配置 API Key' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { 
      audioData, 
      voiceName, 
      fileName = 'voice-sample.mp3',
      contentType = 'audio/mp3',
      duration 
    } = body;

    if (!audioData || !voiceName) {
      return NextResponse.json(
        { error: '缺少必要参数：audioData 或 voiceName' },
        { status: 400 }
      );
    }

    // 验证音频时长（最少3秒）
    if (duration && duration < 3) {
      return NextResponse.json(
        { error: '音频样本时长至少需要3秒' },
        { status: 400 }
      );
    }

    console.log(`[音色克隆] 创建音色: ${voiceName}, 用户: ${userId}`);

    // 1. 上传音频样本到对象存储
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });

    // 将 Base64 转为 Buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // 上传文件（SDK会自动添加UUID前缀）
    const sampleKey = await storage.uploadFile({
      fileContent: audioBuffer,
      fileName: `voice-samples/${userId}/${fileName}`,
      contentType,
    });

    // 生成访问URL（有效期30天，足够智谱API使用）
    const sampleUrl = await storage.generatePresignedUrl({
      key: sampleKey,
      expireTime: 2592000, // 30天
    });

    console.log(`[音色克隆] 样本上传成功: ${sampleKey}`);

    // 2. 调用智谱API创建音色克隆
    const client = await getZhipuClientAsync(userId);
    const cloneResult = await client.createVoiceClone(sampleUrl, voiceName);

    if (cloneResult.status !== 'success') {
      return NextResponse.json(
        { error: cloneResult.message || '音色克隆失败' },
        { status: 500 }
      );
    }

    console.log(`[音色克隆] 智谱返回音色ID: ${cloneResult.voice_id}`);

    // 3. 保存音色信息到数据库
    const supabase = getSupabaseClient();
    const { data: voiceRecord, error: dbError } = await supabase
      .from('user_voices')
      .insert({
        user_id: userId,
        voice_id: cloneResult.voice_id,
        voice_name: voiceName,
        sample_url: sampleKey, // 存储key而非URL
        duration: duration || null,
        status: 'active',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[音色克隆] 数据库保存失败:', dbError);
      return NextResponse.json(
        { error: '音色克隆成功，但保存失败', voiceId: cloneResult.voice_id },
        { status: 500 }
      );
    }

    console.log(`[音色克隆] 创建成功: ${voiceRecord.id}`);

    return NextResponse.json({
      success: true,
      voice: {
        id: voiceRecord.id,
        voiceId: cloneResult.voice_id,
        voiceName: voiceName,
        sampleKey: sampleKey,
        duration: duration,
        createdAt: voiceRecord.created_at,
      },
      message: '音色克隆创建成功',
    });

  } catch (error) {
    console.error('[音色克隆] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '音色克隆失败' },
      { status: 500 }
    );
  }
}
