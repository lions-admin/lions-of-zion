import { PipelineVisualizer } from "@/components/pipeline-visualizer";

export const metadata = {
  title: "הדמיית צינור המערכת החיה | Lions of Zion",
  description:
    "הדמיה אינטראקטיבית חיה של זרימת המידע, מנוע אימות הטענות, שערי הפרסום ומכונת הבריף היומי — מתוך קוד המערכת.",
};

export default function PipelinePage() {
  return (
    <main>
      <PipelineVisualizer />
    </main>
  );
}
