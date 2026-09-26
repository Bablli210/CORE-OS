import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { configurePlatform } from "@gymos/api/platform";
import { createNativePlatform } from "./platform-core";

// No reachability pings (they would call a Google URL); NetInfo's connected flag is enough to decide "queue or send".
NetInfo.configure({ reachabilityShouldRun: () => false });

export const nativePlatform = createNativePlatform(AsyncStorage, NetInfo);
configurePlatform(nativePlatform);
