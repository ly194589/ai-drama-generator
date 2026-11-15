import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 获取音频列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type'); // voice, bgm, sfx
    const category = searchParams.get('category');

    // 获取当前用户ID
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false, audios: [] },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('audio_materials')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }
    if (category) {
      query = query.eq('category', category);
    }

    const { data: audios, error } = await query;

    if (error) {
      console.error('数据库查询错误:', error);
      return NextResponse.json(
        { error: '获取音频列表失败' },
        { status: 500 }
      );
    }

    // 为每个音频生成访问URL
    const audiosWithUrls = await Promise.all(
      (audios || []).map(async (audio: Record<string, unknown>) => {
        const audioUrl = await storage.generatePresignedUrl({
          key: audio.file_key as string,
          expireTime: 86400,
        });
        return { ...audio, audioUrl };
      })
    );

    return NextResponse.json({
      success: true,
      audios: audiosWithUrls,
    });
  } catch (error) {
    console.error('获取音频列表失败:', error);
    return NextResponse.json(
      { error: '获取音频列表失败' },
      { status: 500 }
    );
  }
}

// 上传音频
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';
    const type = formData.get('type') as string; // voice, bgm, sfx
    const category = formData.get('category') as string;
    const characterName = formData.get('characterName') as string;
    const voiceStyle = formData.get('voiceStyle') as string;
    const emotion = formData.get('emotion') as string;
    const mood = formData.get('mood') as string;
    const tempo = formData.get('tempo') as string;

    if (!file || !type) {
      return NextResponse.json(
        { error: '请提供文件和音频类型' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('audio/')) {
      return NextResponse.json(
        { error: '请上传音频文件' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `audio/${type}/${Date.now()}_${file.name}`;

    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: fileBuffer,
      fileName,
      contentType: file.type,
    });

    const supabase = getSupabaseClient();

    // 保存到数据库
    const { data: audio, error } = await supabase
      .from('audio_materials')
      .insert({
        title: title || file.name,
        description,
        type,
        category,
        file_key: fileKey,
        file_name: file.name,
        file_size: file.size,
        duration: 0, // 需要额外处理获取时长
        format: file.type.split('/')[1],
        character_name: characterName,
        voice_style: voiceStyle,
        emotion,
        mood,
        tempo,
      })
      .select()
      .single();

    if (error) {
      console.error('保存音频失败:', error);
      return NextResponse.json(
        { error: '保存音频失败' },
        { status: 500 }
      );
    }

    // 生成访问URL
    const audioUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400,
    });

    return NextResponse.json({
      success: true,
      audio: { ...audio, audioUrl },
    });
  } catch (error) {
    console.error('上传音频失败:', error);
    return NextResponse.json(
      { error: '上传音频失败' },
      { status: 500 }
    );
  }
}
