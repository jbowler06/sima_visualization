import numpy as np
from  skimage import img_as_ubyte as skimage_img_as_ubyte
from PIL import Image
import base64
import StringIO
import warnings


def img_as_ubyte(img):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")

        return skimage_img_as_ubyte(img)


def convertToB64Jpeg(arr, quality=100):
    img = Image.fromarray(arr, 'L')
    img_io = StringIO.StringIO()
    img.save(img_io, 'jpeg', quality=quality)
    img_io.seek(0)

    return 'data:image/jpeg;base64,'+base64.b64encode(img_io.read())


def load_frames_zprojection(seq, frame_idxs, lut_cutoffs, channel,
                            quality, frames_out):
    n_planes = seq.shape[1]
    seq = np.array(
    seq[:, :, :, :, channel:channel+1])[..., 0]

    seq = np.clip(seq, *lut_cutoffs)
    seq -= lut_cutoffs[0]
    seq /= np.nanmax(seq)

    zsurfs = map(img_as_ubyte, np.nanmean(seq, axis=1))

    ysurfs = np.nanmean(seq, axis=2)
    ysurfs = map(img_as_ubyte, ysurfs)

    xsurfs = np.nanmean(seq, axis=3)
    xsurfs = map(img_as_ubyte, xsurfs)
    for fr_idx, z, y, x in zip(frame_idxs, zsurfs, ysurfs, xsurfs):
        frames_out['frame_%s' % fr_idx][0] = {
            'z': convertToB64Jpeg(z, quality=quality),
            'y': convertToB64Jpeg(y, quality=quality),
            'x': convertToB64Jpeg(x.T, quality=quality),
        }


def load_frames(seq, frame_idxs, lut_cutoffs, plane, channel, quality,
               frames_out):
    if plane == 0:
        return load_frames_zprojection(seq, frame_idxs, lut_cutoffs, channel,
                                       quality, frames_out)

    n_planes = seq.shape[1]
    seq = np.array(
        seq[:, plane-1:plane, :, :, channel:channel+1])[:, 0, :, :, 0]

    seq = np.clip(seq, *lut_cutoffs)
    seq -= lut_cutoffs[0]
    seq /= np.nanmax(seq)

    zsurfs = map(img_as_ubyte, seq)

    ysurfs = np.zeros((seq.shape[0], n_planes, seq.shape[2]))
    ysurfs[:, plane-1] = np.nanmean(seq, axis=1)
    ysurfs = map(img_as_ubyte, ysurfs)

    xsurfs = np.zeros((seq.shape[0], seq.shape[1], n_planes))
    xsurfs[:, :, plane-1] = np.nanmean(seq, axis=2)
    xsurfs = map(img_as_ubyte, xsurfs)
    for fr_idx, z, y, x in zip(frame_idxs, zsurfs, ysurfs, xsurfs):
        frames_out['frame_%s' % fr_idx][plane] = {
            'z': convertToB64Jpeg(z, quality=quality),
            'y': convertToB64Jpeg(y, quality=quality),
            'x': convertToB64Jpeg(x, quality=quality),
        }


def load_frames_multiplane(seq, frame_idxs, lut_cutoffs, planes, channel, quality,
               frames_out):
    if 0 in planes:
        load_frames_zprojection(seq, frame_idxs, lut_cutoffs, channel,
                                       quality, frames_out)
        planes.remove(0)
        if not len(planes):
            return

    n_planes = seq.shape[1]
    seq = np.array(
        seq[:, :, :, :, channel:channel+1])[..., 0]

    for pidx in planes:
        if pidx == 0:
            _seq = np.nanmean(seq[:, :, :, :, channel:channel+1],
                              axis=1)[..., 0]
        else:
            _seq = np.array(seq[:, pidx-1, :, :, channel:channel+1])[..., 0]
        _seq = np.clip(_seq, *lut_cutoffs)
        _seq -= lut_cutoffs[0]
        _seq /= np.nanmax(_seq)

        zsurfs = map(img_as_ubyte, _seq)

        ysurfs = np.zeros((_seq.shape[0], n_planes, _seq.shape[2]))
        ysurfs[:, plane-1] = np.nanmean(_seq, axis=1)
        ysurfs = map(img_as_ubyte, ysurfs)

        xsurfs = np.zeros((_seq.shape[0], _seq.shape[1], n_planes))
        xsurfs[:, :, plane-1] = np.nanmean(_seq, axis=2)
        xsurfs = map(img_as_ubyte, xsurfs)
        for fr_idx, z, y, x in zip(frame_idxs, zsurfs, ysurfs, xsurfs):
            frames_out['frame_%s' % fr_idx][plane] = {
                'z': convertToB64Jpeg(z, quality=quality),
                'y': convertToB64Jpeg(y, quality=quality),
                'x': convertToB64Jpeg(x, quality=quality),
            }
