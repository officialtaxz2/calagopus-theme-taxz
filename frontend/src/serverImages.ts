// Eigene Serverbilder (Designvorgabe 9.18, Idee 22): Liste der Bilder aller sichtbaren Server, Hochladen und Entfernen.
// Gespeichert und zugeschnitten wird im Backend der Erweiterung (server_image.rs).

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { useAuth } from '@/providers/contexts/authContext.ts';

const KEY = ['taxz', 'server-images'];
const listSchema = z.object({ images: z.record(z.string(), z.string()) });

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export function useServerImages() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...KEY, user?.uuid],
    queryFn: async () => listSchema.parse((await axiosInstance.get('/api/client/extensions/de.taxz.theme/server-images')).data).images,
    enabled: !!user,
    staleTime: 5 * 60_000,
    // Das Panel stellt refetchOnMount auf 'always'; jede Karte, Kopf und Seitenleiste wuerde sonst neu laden.
    refetchOnMount: true,
  });
}

/** Bildadresse eines Servers oder null (dann gelten die Spielfarben). */
export function useServerImage(uuid: string): string | null {
  const { data } = useServerImages();
  return data?.[uuid] ?? null;
}

export function useServerImageActions(uuid: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  return {
    upload: async (file: Blob) => {
      const { data } = await axiosInstance.put(`/api/client/servers/${uuid}/extensions/de.taxz.theme/image`, file, {
        headers: { 'Content-Type': file.type },
      });
      await refresh();
      return z.object({ url: z.string() }).parse(data).url;
    },
    remove: async () => {
      await axiosInstance.delete(`/api/client/servers/${uuid}/extensions/de.taxz.theme/image`);
      await refresh();
    },
  };
}
