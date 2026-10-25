import type { Caption } from "@remotion/captions";
import React from "react";
import { Composition, staticFile } from "remotion";
import { PROJECTS } from "./projects";
import { Short } from "./Short";
import { outDuration, segmentsOf } from "./timeline";
import type { Project, ShortProps } from "./types";

const load = async (name: string): Promise<{ project: Project; captions: Caption[] }> => {
  const project = (await (await fetch(staticFile(`projects/${name}/project.json`))).json()) as Project;
  const res = await fetch(staticFile(`projects/${name}/captions.json`));
  const captions = res.ok ? ((await res.json()) as Caption[]) : [];
  return { project, captions };
};

// 每個 public/projects/<名稱>/ 都是一支影片（清單由 npm run new 自動更新）
export const RemotionRoot: React.FC = () => (
  <>
    {PROJECTS.map((name) => (
      <Composition
        key={name}
        id={name}
        component={Short}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={300}
        defaultProps={{ name, project: { video: "", durationSec: 10 }, captions: [] } as ShortProps}
        calculateMetadata={async ({ props }) => {
          const { project, captions } = await load(props.name);
          const fps = project.fps ?? 30;
          return {
            fps,
            width: project.width ?? 1080,
            height: project.height ?? 1920,
            durationInFrames: Math.max(1, Math.round(outDuration(segmentsOf(project)) * fps)),
            props: { ...props, project, captions },
          };
        }}
      />
    ))}
  </>
);
