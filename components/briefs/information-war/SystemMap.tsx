import { SystemFlowBeams } from "@/components/briefs/InformationWarBeams";
import { PIPELINE_STAGES } from "./pipeline-data";
import styles from "@/components/briefs/information-war-system.module.css";

/**
 * The interactive system map: the seven stages on one rail.
 *
 * Server markup only. Each stage is a `<details>` disclosure so keyboard,
 * screen-reader and no-JS readers all get inputs → outputs → dependencies
 * without a client round-trip. The `data-beam-node` marks are the travelling
 * packet anchors consumed by `SystemFlowBeams`; the CSS rail is the diagram
 * when beams are absent or motion is reduced.
 */
export function SystemMap() {
  return (
    <SystemFlowBeams>
      <ol className={styles.stageChain}>
        {PIPELINE_STAGES.map((stage) => (
          <li key={stage.name}>
            <div className={styles.stageRail}>
              <i aria-hidden="true" data-beam-node={stage.number} />
            </div>
            <div className={styles.stageBody}>
              <p className={styles.stageMeta}>
                <span>{stage.number}</span>
                <span>{stage.job}</span>
              </p>
              <h3>{stage.name}</h3>
              <p>{stage.detail}</p>
              <p className={styles.mechanism}>{stage.mechanism}</p>
              <details className={styles.stageInspector}>
                <summary>
                  Stage details<span aria-hidden="true"> +</span>
                </summary>
                <dl>
                  <div>
                    <dt>Job stage</dt>
                    <dd dir="ltr">{stage.job}</dd>
                  </div>
                  <div>
                    <dt>Inputs</dt>
                    <dd>{stage.inputs}</dd>
                  </div>
                  <div>
                    <dt>Outputs</dt>
                    <dd>{stage.outputs}</dd>
                  </div>
                  <div>
                    <dt>Live status</dt>
                    <dd>No telemetry available — per-stage job state is internal.</dd>
                  </div>
                </dl>
              </details>
            </div>
          </li>
        ))}
      </ol>
    </SystemFlowBeams>
  );
}
