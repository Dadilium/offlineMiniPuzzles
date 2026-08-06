import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { adUnitIds } from '../config/ads';

/** Single app-wide anchored adaptive banner, mounted once beneath the
 * navigator (see App.tsx) so screen navigation never remounts it. Reserves
 * no layout space -- including the bottom safe-area inset -- until the ad
 * actually loads, so a slow or failed load never leaves a gap. */
export default function AdBanner() {
  const [loaded, setLoaded] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <View style={loaded ? [styles.slot, { paddingBottom: insets.bottom }] : styles.collapsed}>
      <BannerAd
        unitId={adUnitIds.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center' },
  collapsed: { height: 0, overflow: 'hidden' },
});
