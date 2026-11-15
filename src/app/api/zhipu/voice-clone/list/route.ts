import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';

/**
 * 获取用户音色列表
 * 
 * GET /api/zhipu/voice-clone/list
 * 
 * 返回用户创建的所有音色克隆
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';

    const supabase = getSupabaseClient();
    const { data: voices, error } = await supabase
      .from('user_voices')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[音色列表] 查询失败:', error);
      return NextResponse.json(
        { error: '获取音色列表失败' },
        { status: 500 }
      );
    }

    // 为每个音色生成样本访问URL
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });

    const voicesWithUrls = await Promise.all(
      (voices || []).map(async (voice) => {
        try {
          // 从存储key生成临时访问URL
          const sampleUrl = await storage.generatePresignedUrl({
            key: voice.sample_url,
            expireTime: 3600, // 1小时
          });
          
          return {
            ...voice,
            sampleUrl,
          };
        } catch (error) {
          console.error(`[音色列表] 生成URL失败: ${voice.id}`, error);
          return {
            ...voice,
            sampleUrl: null,
          };
        }
      })
    );

    console.log(`[音色列表] 查询成功: ${voicesWithUrls.length} 个音色`);

    return NextResponse.json({
      success: true,
      voices: voicesWithUrls,
      total: voicesWithUrls.length,
    });

  } catch (error) {
    console.error('[音色列表] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取音色列表失败' },
      { status: 500 }
    );
  }
}
