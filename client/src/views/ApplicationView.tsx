import { useParams } from "react-router-dom";

export default function ApplicationView() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-brand-ink">Application {id}</h1>
    </div>
  );
}
