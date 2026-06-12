import { SheepShuttle } from '../../logic/shuttle/sheepShuttle.js'
// (Removed invalid ShuttleFile import)
// Worker側のShuttleインスタンス
const shuttle = new SheepShuttle()

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  try {
    if (type === 'PARSE') {
      const files: { name: string, content: string | ArrayBuffer | Uint8Array }[] = payload.files;
      await shuttle.parse(files, (msg) => {
        self.postMessage({ id, status: 'progress', message: msg });
      });

      self.postMessage({
        id,
        status: 'success',
        result: {
          units: shuttle.units,
          files: shuttle.files
        }
      });
    } 
    else if (type === 'BUILD_INDEX') {
      const { units, data } = payload;
      
      // Worker側の検索インスタンスにインデックスを張る
      shuttle.searcher.clear();
      if (data) {
        shuttle.data = data;
        shuttle.searcher.indexShwvData(data, (msg) => {
          self.postMessage({ id, status: 'progress', message: msg });
        });
      } else if (units && units.length > 0) {
        shuttle.units = units;
        shuttle.searcher.indexUnits(units, (msg) => {
          self.postMessage({ id, status: 'progress', message: msg });
        });
      }

      // メインスレッドに渡すためにエクスポート
      const exported = await shuttle.searcher.exportFullData();

      self.postMessage({
        id,
        status: 'success',
        result: exported
      });
    }
    else {
      throw new Error(`Unknown command: ${type}`);
    }
  } catch (err: any) {
    self.postMessage({
      id,
      status: 'error',
      error: err.message || 'Unknown error in worker'
    });
  }
}
