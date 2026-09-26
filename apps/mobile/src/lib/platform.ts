import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";
import { configurePlatform } from "@gymos/api/platform";
import { browserNetInfo, createNativePlatform } from "./platform-core";

// No reachability pings (they would call a Google URL); NetInfo's connected flag is enough to decide "queue or send".
NetInfo.configure({ reachabilityShouldRun: () => false });

export const nativePlatform = createNativePlatform(AsyncStorage, Platform.OS === "web" ? browserNetInfo(window) : NetInfo);
configurePlatform(nativePlatform);
