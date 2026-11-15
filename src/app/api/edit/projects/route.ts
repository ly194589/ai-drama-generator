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

// 获取剪辑项目列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseClient();
    
    const { data: projects, error } = await supabase
      .from('edit_projects')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('数据库查询错误:', error);
      return NextResponse.json(
        { error: '获取项目列表失败' },
        { status: 500 }
      );
    }

    // 为有输出文件的项目生成访问URL
    const projectsWithUrls = await Promise.all(
      (projects || []).map(async (project: Record<string, unknown>) => {
        if (project.output_file_key) {
          const outputUrl = await storage.generatePresignedUrl({
            key: project.output_file_key as string,
            expireTime: 86400,
          });
          return { ...project, outputUrl };
        }
        return project;
      })
    );

    return NextResponse.json({
      success: true,
      projects: projectsWithUrls,
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    return NextResponse.json(
      { error: '获取项目列表失败' },
      { status: 500 }
    );
  }
}

// 创建剪辑项目
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, config, assets } = body;

    if (!title || !config) {
      return NextResponse.json(
        { error: '请提供项目标题和配置' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 创建项目
    const { data: project, error: projectError } = await supabase
      .from('edit_projects')
      .insert({
        title,
        description: description || '',
        config,
        status: 'draft',
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error('创建项目错误:', projectError);
      return NextResponse.json(
        { error: '创建项目失败' },
        { status: 500 }
      );
    }

    // 添加素材关联
    if (assets && assets.length > 0) {
      const assetsData = assets.map((asset: Record<string, unknown>, index: number) => ({
        project_id: project.id,
        type: asset.type,
        file_key: asset.fileKey,
        file_name: asset.fileName,
        source_url: asset.sourceUrl,
        duration: asset.duration,
        start_time: asset.startTime,
        end_time: asset.endTime,
        order: index,
        metadata: asset.metadata || {},
      }));

      const { error: assetsError } = await supabase
        .from('edit_assets')
        .insert(assetsData);

      if (assetsError) {
        console.error('添加素材错误:', assetsError);
      }
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error('创建项目失败:', error);
    return NextResponse.json(
      { error: '创建项目失败' },
      { status: 500 }
    );
  }
}
