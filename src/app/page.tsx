import { Suspense } from "react";
import HomeClaim from "./home-claim";

export default function Page() {
  return (
    <Suspense>
      <HomeClaim />
    </Suspense>
  );
}
