import axios from 'axios';

export function parseRoboflowPredictions(result) {
  return (
    result?.outputs?.[0]?.predictions?.predictions ||
    result?.outputs?.[0]?.predictions ||
    []
  );
}

export async function detectWithRoboflow(imageInput) {
  const apiUrl = process.env.ROBOFLOW_API_URL;
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const classes = process.env.ROBOFLOW_CLASSES;

  if (!apiUrl || !apiKey || !classes) {
    throw new Error('Roboflow environment variables are not configured');
  }

  try {
    const { data } = await axios.post(
      apiUrl,
      {
        api_key: apiKey,
        inputs: {
          image: imageInput,
          classes
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: Number(process.env.ROBOFLOW_TIMEOUT_MS || 60000)
      }
    );

    return parseRoboflowPredictions(data);
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.response?.data?.detail ||
      error?.message ||
      'Failed to call Roboflow';

    const wrappedError = new Error(`Roboflow detection failed: ${message}`);
    wrappedError.statusCode = error?.response?.status || 502;
    throw wrappedError;
  }
}

